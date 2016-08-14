"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 7/31/16
 */

var Promise = require("bluebird");
var constants = require("./constants");
var utils = require("./utils");
var TaskMdl;

var INITIAL = constants.INITIAL;
var DONE = constants.DONE;
var SAVE = constants.SAVE;
var UPDATE = constants.UPDATE;
var REMOVE = constants.REMOVE;
var ROLLED = constants.ROLLED;
var updateState = utils.updateState;
var getModel = utils.getModel;

var RollerProvider = function(_TaskMdl){
  TaskMdl = _TaskMdl;

  return Roller;
};

var Roller = {
  roll: function(){
    var chain = Promise.resolve();

    return TaskMdl.find().exec()
      .then(function(tasks){
        var step;
        var lastIndex;
        var firstStep;
        var lastStep;

        tasks.forEach(function(task){
          lastIndex = task.steps.length - 1;
          firstStep = task.steps[0];
          lastStep = task.steps[lastIndex];

          if(lastStep.state !== DONE && firstStep.state !== INITIAL){
            for(var i = lastIndex; i >= 0 ; i--){
              step = task.steps[i];

              if(step.state === INITIAL || step.state === ROLLED) continue;

              //iife to avoid async issues
              (function(step){
                chain = chain.then(function(){
                  return getRollbackFunc(step)(step, task);
                });
              })(step);
            }
          }

          chain = chain.then(function(){
            return task.remove();
          });
        });

        return chain;
      });
  }
};

function getRollbackFunc(step){
  switch(step.type){
    case SAVE: return rollbackSave;
    case UPDATE:
    case REMOVE: return rollbackDeleteOrUpdate
  }
}

function rollbackSave(save, task) {
  var Collection = getModel(save.name);

  return Collection.remove({_id: save.dataStore[0]._id})
    .exec()
    .then(function(){
      return updateState(task, save.index, ROLLED);
    });
}

function rollbackDeleteOrUpdate(step, task){
  var Collection = getModel(step.name);
  var chain = Promise.resolve();

  step.dataStore.forEach(function(data){
    chain = chain.then(function(){
      return Collection.findById(data._id)
        .exec()
        .then(function(doc){
          if(doc) {
            return doc.update(data).exec();
          }

          doc = new Collection(data);
          return doc.save();
        });
    });
  });

  return chain.then(function(){
    return updateState(task, step.index, ROLLED);
  });
}

module.exports = RollerProvider;