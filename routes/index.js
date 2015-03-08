var express = require('express');
var router = express.Router();
var oauth = require('oauth');
var async = require('async');

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
    '1.0A',
    null,
    'HMAC-SHA1'
  );
  console.log('before');
  o.getOAuthRequestToken(function(err, token, secret) {   
    console.log('requesting token to xero: getOAuthRequestToken...');
    var redis = require('redis');
    var client = redis.createClient({    
      host: '127.0.0.1',
      port: 6379,
      prefix: 'test-only'  
    });
    var saveToken = function(next) {
      console.log('saving token...' + token);
      client.set('test-only:token', token, function(err) {
        client.expire('test-only:token', 1800, function(err) {
          next();
        });
      });
    };
    var saveSecret = function(next) {
      console.log('saving secret...' + secret);
      client.set('test-only:tokenSecret:' + token, secret, function(err) {
        client.expire('test-only:tokenSecret:' + token, 1800, function(err) {
          next();
        });
      });
    };
    async.series([
      saveToken,
      saveSecret
      ], function(err, data) {
        console.log('request token and secret has been saved to redis');
        res.json({token: token, secret: secret});
      });    
  });
  console.log('after');

});
module.exports = router;