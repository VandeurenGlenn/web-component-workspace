#!/usr/bin/env node
/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';
var yargs = require('yargs');
var path = require('path');

var Commands = require('../lib/commands');
var WebComponentDb = require('../lib/web-component-db');

var repo = function repo(yargs) {
  return yargs
    .string('repo')
    .describe('repo', 'repository to install')
    .alias('repo', 'r')
    .demand('r')
}
var db = new WebComponentDb(path.join(process.cwd(), '.wcw.db'));
var commands = new Commands(db, process.cwd());

var errHandler = function (err) {
  console.log(err.stack);
}

var argv = yargs
  .usage('$0 <command>')
  .demand(1, 'Command must be provided.')
  .command('install',
    'Install the specified package and all transitive bower packages.',
    function(yargs) {
      argv = repo(yargs).argv;
      try {
        commands.install(argv.repo);
      } catch (err) {
        console.log(err.stack);
      }
    })
  .command('update',
    'updates the master branch of all repos without changing the working ' +
    'branch', function(yargs){
        commands.update().catch(errHandler);
    })
  .command('rebase <gitargs>',
   'Rebase all repositories. If no git args are provided, rebase against ' +
   'master')
  .command('test <cmd>',
   'Test all repositories using the specified command. Returns true if ' +
   'all tests return true.')
  .argv;
