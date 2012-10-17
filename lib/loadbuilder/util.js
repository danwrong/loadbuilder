var crypto = require('crypto');

function extend(target, source) {
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });

  return target;
}

function hashString(string, salt) {
  salt = salt || '';
  var hash = crypto.createHash('sha1');
  hash.update(string + salt);
  return hash.digest('hex');
}

module.exports = {
  extend: extend,
  hashString: hashString
};