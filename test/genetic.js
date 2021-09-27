const genetic = require('../genetic')
const fixtures = require('./fixtures/genetic')
var utils = require('./_utils')

fixtures.forEach(function (f) {
    const finputs = utils.expand(f.inputs)
    const foutputs = utils.expand([f.output])
    const actual = genetic(finputs, foutputs[0], f.feeRate);
    console.log(actual);
});

