var utils = require('./utils')

const POPULATION_SIZE = 5;
const NUM_GENERATIONS = 10000;

// 10 sats/vB
const LONG_TERM_FEE = 10;

// 10% mutation rate
const MUTATION_RATE = 10;

let population = [];
let best_solution = [];

function createIndividualTargetExceeded(utxos, target, fee_rate) {
    
    for (let i = 0; i < 50000; i++) {
        let individual = utils.getRandom(utxos, utils.getRandomInt(1, utxos.length));
        let individual_value = individual.reduce((a, b) => a + (b.value || 0), 0);
        const scripts_size = individual.reduce((a, b) => a + (utils.inputBytes(b) || 0), 0);
        individual_value = individual_value + (scripts_size * fee_rate);
        
        if (individual_value >= target) {
            return utxos;
        }
    }

    return [];
}

function createPopulation(utxos, num_genes, target, fee_rate) {
    // Create random individuals
    for (let i = 0; i < POPULATION_SIZE; i++) {
        if (i < POPULATION_SIZE - 2) {
            population.push(utils.getRandom(utxos, num_genes));
        }
    }

    // Create an individual that selects all UTXOs in the wallet
    population.push(utils.getRandom(utxos, utxos.length));

    // Create an individual the target is excedeed
    population.push(createIndividualTargetExceeded(utxos, target, fee_rate));
}

function mutation(utxos, generation, fee_rate) {
    population = [];
    
    // Keep the best previous solution 
    population.push(best_solution);

    if (generation > parseInt(NUM_GENERATIONS) / 2) {
        if (fee_rate < LONG_TERM_FEE) {
            population.push(utils.getRandom(utxos, parseInt(best_solution.length * 1.4)));
            population.push(utils.getRandom(utxos, parseInt(best_solution.length * 1.2)));
        } else {
            population.push(utils.getRandom(utxos, parseInt(best_solution.length * 0.8)));
            population.push(utils.getRandom(utxos, parseInt(best_solution.length * 0.6)));
        }

        for (let i = 0; i < POPULATION_SIZE - (POPULATION_SIZE - 3); i++) {
            let new_individual = [];
            best_solution.forEach(gene => {
                let random = utils.getRandomInt(0, 100);
                if (random <= MUTATION_RATE) {
                    new_individual.push(utils.getRandom(utxos, 1)[0]);
                } else {
                    new_individual.push(gene);
                }
            });
            population.push(new_individual);
        }
    } else {
        // Create random individuals with random size
        for (let i = 0; i < POPULATION_SIZE - 1; i++) {
            population.push(utils.getRandom(utxos, utils.getRandomInt(1, utxos.length)));
        }
    }
}

function getSelectionWaste(individual, fee_rate, target, outputs) {
    let waste = 0;
    let selected_effective_value = 0;
    
    individual.forEach((utxo) => {
        waste += utils.inputBytes(utxo) * fee_rate - utils.inputBytes(utxo) * LONG_TERM_FEE;
        selected_effective_value += utxo.value - utils.inputBytes(utxo) * fee_rate;
    });

    /* Discard this solution */
    if (selected_effective_value < target) {
        return 100000;
    }

    let finalized = utils.finalize(individual, outputs, fee_rate);

    /* If there is change, consider its cost */
    if (finalized.outputs.length > outputs.length) {
        const cost_change = utils.outputBytes({}) * fee_rate + utils.inputBytes({}) * LONG_TERM_FEE;
        waste += cost_change;
    }

    waste += selected_effective_value - target;

    return waste;
}

// Fitness is based on waste metric
function fitness(fee_rate, value, outputs) {
    let best_value = 100000;
    population.forEach((individual) => {
        let waste = getSelectionWaste(individual, fee_rate, value, outputs);
        if (waste < best_value) {
            best_value = waste;
            if (best_solution != individual) {
                console.log(individual);
                console.log(individual.length);
            }
            best_solution = individual;
        }
    });
}

function defineNumGenes(utxos, outputs) {
    const value = utils.sumOrNaN(outputs);

    /* Define how many genes every individual will have
    based on the average value of the utxos */
    let num_genes = parseInt(utxos.reduce((a, b) => a + (b.value || 0), 0) / utxos.length);
    num_genes = parseInt(value / num_genes);
    
    if (num_genes < 1)
        num_genes = 1;

    return num_genes;
}

module.exports = function genetic (utxos, outputs, fee_rate) {
    const value = utils.sumOrNaN(outputs) + (outputs.reduce((a, b) => a + (utils.outputBytes(b) || 0), 0) * fee_rate);

    // Starts creating the initial population
    createPopulation(utxos, defineNumGenes(utxos, outputs), value, fee_rate);

    for (let i = 0; i < NUM_GENERATIONS; i++) {
        fitness(fee_rate, value, outputs);
        mutation(utxos, i, fee_rate);
    }

    return utils.finalize(best_solution, outputs, fee_rate);
}