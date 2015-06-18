/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
// jshint node:true
'use strict';
var url = require('url');
var nodegit = require('nodegit');
var clone = nodegit.Clone.clone;
var shell = require('shelljs');
var temp = require('temp');
var path = require('path');
var fs = require('fs');


shell.config.silent = true; 

function bower(args) {
  var cmd = path.join(__dirname, '..', 'node_modules', '.bin', 'bower');
  return cmd + ' ' + args;
}

var Commands = function Commands(db) {
  this.__db = db;
}

Commands.prototype = {
  /**
   * Resolves a package.
   * @param  {string} pkg A bower-like repository description, github repo, or other git url
   * @return {Array.<{{folder:string, repository:}}>}     A list of packages and URLs to add to the workspace.
   */
  resolve: function(pkg) {
    // Install the package to a tempdir
    var tmpDir = temp.mkdirSync('wcw');
    shell.pushd(tmpDir);
    shell.exec(bower(' install ' + pkg));
    console.log("Listing paths!");
    shell.pushd('bower_components');
    var packages = [];
    shell.ls('./').forEach(function(component){
      // console.log(shell.ls(component));
      var bowerjson =
        JSON.parse(fs.readFileSync(path.join(component, "bower.json")));
      if (bowerjson.repository == undefined || bowerjson.repository.type != 'git') {
        console.warn("Repository must be specified for " + bowerjson.name);
        return;
      }
      packages.push({folder: component, repo: bowerjson.repository})
    })
    shell.popd();
    return packages
  },
  load: function(dir, repo) {
    this.__db.addPackage(dir, repo);
    nodegit.Clone(
      repo.url,
      dir,
      {
        remoteCallbacks: {
          certificateCheck: function() {
            // github will fail cert check on some OSX machines
            // this overrides that check
            return 1;
          }
        }
      })
    .then(function(repo) {
      console.log("repo  in dir " + dir + " has been cloned");
    }).catch(function(err){
      console.log(err);
      console.log(err.stack);
    });
  },
  install: function(pkg, dir) {
    console.log('installing');
    console.log(pkg);
    var resolved = this.resolve(pkg);
    resolved.forEach(function(pkg){
      this.load(path.join(dir, pkg.folder), pkg.repo);
    }.bind(this));
  }
}

module.exports = Commands;