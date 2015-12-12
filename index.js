"use strict";

var PouchDB = require("pouchdb");
var Promise = require('lie');
var express = require('express');

function startExpress(port) {
    return new Promise(function(resolve, reject) {
        var app = express();
        app.use('/', require('express-pouchdb')(PouchDB));
        app.listen(port, function(err) {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

var generatedDocsPerRun = 1000;

function writeManyTimesFast(db, docsObj) {
    var promisesArray = [];
    var counter = 0;
    for (var i = 0; i < generatedDocsPerRun; ++i) {
        promisesArray.push(
          new Promise(function(resolve, reject) {
              setTimeout(function() {
                  ++counter;
                  var doc = {_id: db._db_name + counter};
                  if (docsObj[doc._id]) {
                      console.log("We have a repeated doc id! " + doc._id);
                  }
                  docsObj[doc._id] = true;
                  db.put(doc) // This stupid ID is just to prove that the ID is unique
                    .then(function() {
                        resolve();
                    }).catch(function() {
                        reject();
                    });
              }, 1);
          })
        );
    }
    return Promise.all(promisesArray);
}

function matchDocs(localDocs, localName, allDocsResult, resultName) {
    var rows = allDocsResult.rows;
    Object.getOwnPropertyNames(localDocs).forEach(function(localDoc) {
        var found = false;
        rows.forEach(function(resultDoc) {
            if (resultDoc.id == localDoc) {
                found = true;
            }
        });
        if (!found) {
            console.log("Could not find id " + localDoc + " from " + localName + " in " + resultName);
        }
    });
}

var db1port = 5984;
var db2port = 5985;
var db1Name = "http://127.0.0.1:" + db1port + "/foo";
var db2Name = "http://127.0.0.1:" + db2port + "/foo";
db2Name = "foo";
var db1 = new PouchDB(db1Name);
var db2 = new PouchDB(db2Name);
var db1Docs = {};
var db2Docs = {};

var db1Info = null;
var db2Info = null;
var db1AllDocs = null;
var db2AllDocs = null;

startExpress(5984)
    //.then(function() {
    //    return startExpress(5985);
    //})
  .then(function() {
      return db1.destroy();
  }).then(function() {
      db1 = new PouchDB(db1Name);
      db2 = new PouchDB(db2Name);
      var promisesArray = [];
      promisesArray.push(writeManyTimesFast(db1, db1Docs));
      promisesArray.push(writeManyTimesFast(db2, db2Docs));
      return Promise.all(promisesArray);
  }).then(function() {
      if (Object.getOwnPropertyNames(db1Docs).length != generatedDocsPerRun) {
          console.log("db1Docs length is wrong.");
      }
      if (Object.getOwnPropertyNames(db2Docs).length != generatedDocsPerRun) {
          console.log("db2Docs length is wrong");
      }
      // Spurious delay just in case things take a while to settle on disk
      return new Promise(function(resolve, reject) {
          setTimeout(function() {
              resolve();
          }, 1000);
      });
  }).then(function() {
      return db1.allDocs();
  }).then(function(db1AllDocsResult) {
      db1AllDocs = db1AllDocsResult;
      return db2.allDocs();
  }).then(function(db2AllDocsResult) {
      db2AllDocs = db2AllDocsResult;
      console.log("db1 All Docs count = " + db1AllDocs.total_rows);
      console.log("db2 All Docs count = " + db2AllDocs.total_rows);

      if (db1AllDocs.total_rows != generatedDocsPerRun * 2) {
          console.log("Got wrong total_rows for db1AllDocs");
      }

      if (db2AllDocs.total_rows != generatedDocsPerRun * 2) {
          console.log("Got wrong total_rows for db2AllDocs");
      }

      if (db1AllDocs.total_rows != db1AllDocs.rows.length) {
          console.log("db1AllDoc's total_rows != length");
      }

      if (db2AllDocs.total_rows != db2AllDocs.rows.length) {
          console.log("db2AllDoc's total_rows != length");
      }

      matchDocs(db1Docs, "db1", db1AllDocs, "db1");
      matchDocs(db2Docs, "db2", db1AllDocs, "db1");
      matchDocs(db1Docs, "db1", db2AllDocs, "db2");
      matchDocs(db2Docs, "db2", db2AllDocs, "db2");

      return db1.info();
  }).then(function(db1InfoResult) {
      db1Info = db1InfoResult;
      return db2.info();
  }).then(function(db2InfoResult) {
      db2Info = db2InfoResult;
      console.log("db1 info count = " + db1Info.doc_count);
      console.log("db2 info count = " + db2Info.doc_count);
      console.log("db1 update_seq = " + db1Info.update_seq);
      console.log("db2 update_seq = " + db2Info.update_seq);
  }).catch(function(err) {
      console.log("we failed with " + err);
  });
