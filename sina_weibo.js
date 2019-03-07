var fw = require('fs')
var system = require('system');
var page = require('webpage').create();

page.settings.loadImages = false;
page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.221 Safari/537.36 SE 2.X MetaSr 1.0';

var resource_download_timestamp = (new Date()).valueOf();
var resource_download_timeout = 3*1000;
var resource_check_interval = 1*1000;
var page_load_timeout = 5*1000;

var params = system.args[1];
var obj = JSON.parse(params);
var username = obj['username'];
var password = obj['password'];
var address = "https://weibo.com/";
var stage = 0;
// 0:login
// 1:redirect
// 2:loops


page.captureContent = [/.*/];
page.onResourceReceived = function(response) {
  if ((/https:\/\/weibo\.com\/u\/[0-9]*\/home\?pids=Pl_Content_HomeFeed.*/gi).test(response.url) && response['stage'] == 'end') {
    var Reg = /<script>parent.FM.view\((.*?)\)<\/script>/;
    var body = Reg.exec(response.body)[1];
    system.stdout.writeLine('[DATA]:' + body.replace(/\n/g, ''));
  }
  resource_download_timestamp = (new Date()).valueOf();
};


function login(username, password) {
  page.evaluate(function(username, password) {
    document.getElementById('loginname').value = username;
    document.getElementsByName('password')[0].value = password;
    document.querySelector('a[node-type="submitBtn"]').click();
  }, username, password);
}

setInterval(function(){
  var now = (new Date()).valueOf();
  var diff = now - resource_download_timestamp;
  console.log("[LOG]:stage:" + stage + " diff:" + diff);

  if (stage == 0) {
    if (diff > page_load_timeout) {
      login(username, password);
      console.log("[DEBUG]:stage changed from:" + stage);
      resource_download_timestamp = (new Date()).valueOf();
      stage = 1;
    }
  }
  else if (stage == 1) {
    if (diff > page_load_timeout) {
      page.evaluate(function(){
        setInterval(function (){
          var ev = document.createEvent("MouseEvents");
          ev.initEvent("click", true, true);
          var obj = document.querySelector("div[id$='home_new_feed_tip']");
          if (obj)
            obj.dispatchEvent(ev);
        }, 3*1000);
      });
      page.render('weibo.jpeg', {format: 'jpeg', quality: '100'});
      stage = 2;
    }
  }
} , resource_check_interval);

page.open(address);
