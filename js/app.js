'use strict';

// V2.4 Stable Core application namespace.
// This first step defines the single public namespace without changing V2.3 runtime behavior.
const DutchTrainer = window.DutchTrainer || {};

DutchTrainer.version = '2.4.0';
DutchTrainer.schemaVersion = 3;
DutchTrainer.db = DutchTrainer.db || {};
DutchTrainer.vocabulary = DutchTrainer.vocabulary || {};
DutchTrainer.practice = DutchTrainer.practice || {};
DutchTrainer.history = DutchTrainer.history || {};
DutchTrainer.scheduler = DutchTrainer.scheduler || {};
DutchTrainer.ui = DutchTrainer.ui || {};

window.DutchTrainer = DutchTrainer;
