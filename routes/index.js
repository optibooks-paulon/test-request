var express = require('express');
var router = express.Router();
var oauth = require('oauth');
var async = require('async');
var redis = require('redis');
var client = redis.createClient({    
  host: '127.0.0.1',
  port: 6379,
  prefix: 'test-only'  
});
var expireTime = 1800;
/* GET home page. */
router.get('/', function(req, res) {  
  res.render('index', { title: 'Express' });
});

router.get('/oauth', function(req, res) {
  var o = new oauth.OAuth(
    'https://api.xero.com/oauth/RequestToken',
    'https://api.xero.com/oauth/AccessToken',
    'UZHRDQT9PBL308HIABNBCJCUGNKQYE',
    'VM4LTY2HWG43XGEHHFI5GBOJOTMGIM',
    '1.0',
    'http://localhost:3000/oauth/access',
    'HMAC-SHA1'
  );
  console.log('before');
  o.getOAuthRequestToken(function(err, token, secret) {   
    console.log('requesting token to xero: getOAuthRequestToken...');
    
    var saveToken = function(next) {
      console.log('saving token...' + token);
      client.set('test-only:requestToken', token, function(err) {
        client.expire('test-only:requestToken', expireTime, function(err) {
          next();
        });
      });
    };
    var saveSecret = function(next) {
      console.log('saving secret...' + secret);
      client.set('test-only:requestSecret:' + token, secret, function(err) {
        client.expire('test-only:requestSecret:' + token, expireTime, function(err) {
          next();
        });
      });
    };
    async.series([
      saveToken,
      saveSecret
      ], function(err, data) {
        console.log('request token and secret has been saved to redis');
        var url = 'https://api.xero.com/oauth/Authorize';
        url += '?oauth_token=' + token;
        url += '&redirect_uri=' + 'http://localhost:3000/oauth/access';
        return res.json({token: token, secret: secret, url: url});
      });    
  });
  console.log('after');

});

router.get('/oauth/access', function(req, res) {
  console.log('****** Received GET /oauth/access', req.query);
  var oauth_token = req.query.oauth_token;
  var oauth_verifier = req.query.oauth_verifier;
  var oauth_token_secret = '';
  var oauth_access_token = '';
  var oauth_access_token_secret = '';

  var o = new oauth.OAuth(
    'https://api.xero.com/oauth/RequestToken',
    'https://api.xero.com/oauth/AccessToken',
    'UZHRDQT9PBL308HIABNBCJCUGNKQYE',
    'VM4LTY2HWG43XGEHHFI5GBOJOTMGIM',
    '1.0',
    'http://localhost:3000/oauth/access',
    'HMAC-SHA1'
  );
  var getSecretFromRedis = function(next) {
    client.get('test-only:requestSecret:' + oauth_token, function(err, secret) {
      if(err){
        return next(new Error('Something went wrong getting secret from redis :' + err));
      }
      oauth_token_secret = secret
      next();
    });
  };
  var generateAccessToken = function(next) {
    o.getOAuthAccessToken(oauth_token, oauth_token_secret, oauth_verifier ,function(err, access_token, access_token_secret, results ){
      if(err){
        return next(new Error('Something went wrong getting AccessToken from xero : ' + err));
      }
      oauth_access_token = access_token;
      oauth_access_token_secret = access_token_secret;
      next();
    });
  };
  var saveAccessTokenSecretToRedis = function(next) {
    async.series({
      saveToken: function(nextSave) {
        client.set('test-only:accessToken', oauth_access_token, function(err) {
          if(err){
            return nextSave(new Error('Something went wrong while saving AccessToken :' + err));
          }
          client.expire('test-only:accessToken', expireTime);
          nextSave();
        });
      },
      saveSecret: function(nextSave) {
        client.set('test-only:accessSecret:' + oauth_access_token, oauth_access_token_secret, function(err) {
          if(err){
            return nextSave(new Error('Something went wrong while saving AccessScret :' + err));
          }
          client.expire('test-only:accessSecret:' + oauth_access_token, expireTime);
          nextSave();
        });
      }
    }, function(result) {
      if(typeof result === 'undefined') {
        return next();
      }
      if(typeof result.saveToken !== 'undefined'){
        return next(result.saveToken);
      }
      if(typeof result.saveSecret !== 'undefined'){
        return next(result.saveSecret);
      }
      next(); // just a pre-caution return
    });
  };
  var fetchDataFromXero = function() {
    async.parallel({
      fetchTaxrates: function(next){
        var url = 'https://api.xero.com/api.xro/2.0/taxrates';
        console.log('GET TAXRATES');
        o.get(url, oauth_access_token, oauth_access_token_secret, function(error, data, response){
          if(error){
            console.log(error);
            return next(error);
          }
          console.log(data); // replace this with redis.set
        });        
      },
      fetchAccounts: function(next){
        var url = 'https://api.xero.com/api.xro/2.0/accounts';
        console.log('GET ACCOUNTS');
        o.get(url, oauth_access_token, oauth_access_token_secret, function(error, data, response){
          if(error){
            console.log(error);
            return next(error);
          }
          console.log(data); // replace this with redis.set
        });    
      },
      fetchItems: function(next){ 
        var url = 'https://api.xero.com/api.xro/2.0/items';
        console.log('GET ITEMS');
        o.get(url, oauth_access_token, oauth_access_token_secret, function(error, data, response){
          if(error){
            console.log(error);
            return next(error);
          }
          console.log(data); // replace this with redis.set
        });    
      },
      fetchContacts: function(next){
        var url = 'https://api.xero.com/api.xro/2.0/contacts';
        console.log('GET CONTACTS');
        o.get(url, oauth_access_token, oauth_access_token_secret, function(error, data, response){
          if(error){
            console.log(error);
            return next(error);
          }
          console.log(data); // replace this with redis.set
        });    
      }
    }, function(result){
      console.log(result);
    })
  };
  async.series([
    getSecretFromRedis,
    generateAccessToken,
    saveAccessTokenSecretToRedis    
  ], function(err, result) {
    if(err){
      return res.render('index',{title: 'Load failed', details: err})
    }
    fetchDataFromXero();
    res.render('index', { title: 'Connected' });
  });
});
module.exports = router;
