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
// jshint -W079
var Promise = global.Promise || require('es6-promise').Promise;
// jshint +W079

var url = require('url');
var nodegit = require('nodegit');
var clone = nodegit.Clone.clone;
var Repository = nodegit.Repository;
var Stash = nodegit.Stash;
var shell = require('shelljs');
var temp = require('temp');
var path = require('path');
var fs = require('fs');


shell.config.silent = true; 

function bower(args) {
  var cmd = path.join(__dirname, '..', 'node_modules', '.bin', 'bower');
  return cmd + ' ' + args;
}

function readBower(dir) {
  return  JSON.parse(fs.readFileSync(path.join(dir, "bower.json")));
}

var Commands = function Commands(db, workdir) {
  this._db = db;
  this._workdir = workdir;
  this._tmpDir = temp.mkdirSync('wcw');
  this._staticDirs = {};
};

function bowerDeps(bowerJson) {
  var dependencies = [];
  if (bowerJson.dependencies) {
    Object.keys(bowerJson.dependencies).forEach(function (dep){
      dependencies.push(bowerJson.dependencies[dep]);
    });
  }
  if (bowerJson.devDependencies) {
    Object.keys(bowerJson.dependencies).forEach(function (dep){
      dependencies.push(bowerJson.dependencies[dep]);
    });
  }
  return dependencies;
}

Commands.prototype = {
  /**
   * Resolves a package.
   * @param  {string} pkg A bower-like repository description, github repo, or other git url
   * @return {Array.<{{folder:string, repository:}}>}     A list of packages and URLs to add to the workspace.
   */
  resolve: function(pkg) {
    // Install the package to a tempdir
    shell.pushd(this._tmpDir);
    shell.exec(bower(' install ' + pkg));
    shell.pushd('bower_components');
    var packages = [];
    shell.ls('./').forEach(function(component){
      var bowerjson = readBower(component); 
      if (bowerjson.repository === undefined || bowerjson.repository.type != 'git') {
        if (!this._staticDirs[bowerjson.name]) {
          this._staticDirs[bowerjson.name] = true;
          console.warn("Repository must be specified for " + bowerjson.name + ". Falling back to static mode.");
          packages.push({folder: component, sourcedir: path.join(process.cwd(), component)});
        }
        return;
      }
      packages.push({folder: component, repo: bowerjson.repository});
    }.bind(this));
    shell.popd();
    return packages;
  },
  load: function(dir, repo) {
    return this._db.addPackage(dir, repo).then(function(err){
      if (err) {
        // The package has been loaded.
        return;
      }
      console.log("cloning " + dir);
      return nodegit.Clone(
        repo.url,
        path.join(this._workdir, dir),
        {
          remoteCallbacks: {
            certificateCheck: function() {
              // github will fail cert check on some OSX machines
              // this overrides that check
              return 1;
            }
          }
        });
    }.bind(this)).then(function() {
      return dir;
    }).catch(function(err){
      console.log("failed to initialize repo for dir " + dir);
      console.log(err);
      console.log(err.stack);
      this._db.removePackage(dir);
    });
  },
  deps: function(dir) {
    return this._db.hasPackage(dir).then(function(hasPackage){
      var bowerJson = readBower(path.join(this._workdir, dir));
      return bowerDeps(bowerJson);
    });
  },
  installDeps: function(dir) {
    return this.deps(dir).then(function(deps){
      var depInstalls = [];
      deps.forEach(function(dep){
        depInstalls.push(this.install(dep));
      }.bind(this));
      return Promise.all(depInstalls);
    }.bind(this));
  },
  install: function(pkg) {
    var resolved = this.resolve(pkg);
    var resolutions = [];
    resolved.forEach(function(pkg){
      var loaded;
      if (pkg.repo) {
        loaded = this.load(pkg.folder, pkg.repo);
      } else {
        // If the directory exists but isn't a git checkout, we'll overwrite it here.
        if (!shell.test('-e', pkg.folder) ||
            !shell.test('-e', path.join(pkg.folder, '.git'))) {

          shell.cp('-Rf', pkg.sourcedir, this._workdir);
          loaded = Promise.resolve(pkg.folder);
        }
      }
      loaded = loaded.then(function(dir){
        return this.installDeps(dir);
      }.bind(this));
      resolutions.push(loaded);
    }.bind(this));
    return Promise.all(resolutions);
  },
  update: function() {
    return this._db.getPackages().then(function(packages){
      var repos = [];
      packages.forEach(function(pkg){
        repos.push(Repository.open(path.join(this._workdir, pkg.folder))
          .then(function(repo) {
            var statuses = repo.getStatusExt();
            var modified = false;
            statuses.forEach(function(status){
              if (status.isModified()) {
                modified = true;
              }
            });
            var stash;
            if (modified) {
              stash = Stash.save(repo, repo.defaultSignature(), "wcwstash", 0);
            } else {
              stash = Promise.resolve(false);
            }
            var stashed;
            return stash.then(function(didStash){
              stashed = didStash;
              return repo.fetchAll({
                credentials: function(url, userName) {
                  return nodegit.Cred.sshKeyFromAgent(userName);
                },
                certificateCheck: function() {
                  return 1;
                }
              });
            }).then(function() {
              return repo.mergeBranches("master", "origin/master");
            }).then(function(){
              return {repo: repo, stashed: stashed, folder: pkg.folder};
            });
          }));
      }.bind(this));
      return Promise.all(repos);
    }.bind(this))
    .then(function(repos){
      repos.forEach(function(stashedRepo) {
        this.installDeps(stashedRepo.folder);
        if (stashedRepo.stashed) {
          console.log("Folder " + stashedRepo.folder +
            " had local modifications that were stashed.");
        }
      }.bind(this));
    }.bind(this));
  }
};

module.exports = Commands;