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

var assert = require('assert');
var Datastore = require('nedb');

var WebComponentDb = function WebComponentDb(configFile) {
  assert(typeof configFile == "string", "configFile must be a string.");
  this.db = new Datastore({
    filename: configFile,
    autoload: true
  });
  this.db.ensureIndex({fieldName: 'folder', unique: true});
};

WebComponentDb.prototype = {
  addPackage: function addPackage(folder, repo) {
    return new Promise(function(resolve, reject){
      this.db.insert({folder: folder, repo: repo}, function(err){
        resolve(err);
      });
    }.bind(this));
  },
  hasPackage: function hasPackage(folder) {
    var found = false;
    return new Promise(function(resolve, reject){
      this.db.find({folder: folder}, function(err, docs){
        if (err) {
          console.log(err);
          reject(err);
        }
        if (docs.length == 1){
          resolve(true);
        }
        resolve(false);
      });
    }.bind(this));
  },
  getPackages: function getPackages() {
    return new Promise(function(resolve, reject){
      this.db.find({folder: {$exists: true}}, function(err, packages) {
        resolve(packages);
      });
    }.bind(this));
  }
};

module.exports = WebComponentDb;