var crypto = require('crypto');

function extend(target, source) {
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });

  return target;
}

function hashString(string, salt) {
  salt = salt || '';
  var md5sum = crypto.createHash('sha1');
  md5sum.update(string + salt);
  return md5sum.digest('hex');
}


module.exports = {
  extend: extend,
  hashString: hashString
};