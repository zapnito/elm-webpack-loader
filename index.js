'use strict';

var loaderUtils = require('loader-utils');
var elmCompiler = require('node-elm-compiler');
var path = path || require('path');

var cachedDependencies;

var defaultOptions = {
  cache: false,
  yes: true
};

var getInput = function() {
  return this.resourcePath;
};

var getOptions = function() {
  var globalOptions = this.options.elm || {};
  var loaderOptions = loaderUtils.parseQuery(this.query);
  return Object.assign({
    emitWarning: this.emitWarning
  }, defaultOptions, globalOptions, loaderOptions);
};

var walkSync = function(dir, filelist) {
  var fs = fs || require('fs'),
  files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};

module.exports = function() {
  this.cacheable && this.cacheable();

  var callback = this.async();

  if (!callback) {
    throw 'elm-webpack-loader currently only supports async mode.';
  }

  var input = getInput.call(this);
  var options = getOptions.call(this);

  var dependencies = Promise.resolve()
    .then(() => {
      var baseDir = path.dirname(input);
      var elmFiles = walkSync(baseDir, []);
      elmFiles.forEach(dependency => this.addDependency(dependency));
    })
    .then(function(v) { return { kind: 'success', result: v }; })
    .catch(function(v) { return { kind: 'error', error: v }; });

  var compilation = elmCompiler.compileToString(input, options)
    .then(function(v) { return { kind: 'success', result: v }; })
    .catch(function(v) { return { kind: 'error', error: v }; });

  Promise.all([dependencies, compilation])
    .then(function(results) {
      var output = results[1]; // compilation output
      if (output.kind == 'success') {
        callback(null, output.result);
      } else {
        output.error.message = 'Compiler process exited with error ' + output.error.message;
        callback(output.error);
      }
    });
}
