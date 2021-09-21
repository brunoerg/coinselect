var utils = require('./utils')

const POPULATION_SIZE = 5;
const NUM_GENERATIONS = 1000;

// 40% mutation rate
const MUTATION_RATE = 40;

let population = [];
let best_solution = [];

function createPopulation(utxos, num_genes) {
    for (let i = 0; i < POPULATION_SIZE; i++) {
        population.push(utils.getRandom(utxos, num_genes));
    }
}

function mutation(utxos) {
    population = [];
    
    //Keep the best solution 
    population.push(best_solution);

    // Create a random individual with a random size
    population.push(utils.getRandom(utxos, utils.getRandomInt(1, utxos.length)));

    for (let i = 0; i < POPULATION_SIZE - 2; i++) {
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
}

function fitness(feeRate, utxos, outputs) {
    const value = utils.sumOrNaN(outputs);
    let best_script_size = 10000000;
    for (const individual of population) {
        const individual_value = individual.reduce((a, b) => a + (b.value || 0), 0);
        const scripts_size = individual.reduce((a, b) => a + (utils.inputBytes(b) || 0), 0);
        const final_value = individual_value + (scripts_size * feeRate);
        
        if (final_value == value) {
            best_solution = individual;
            return true;
        } else if (final_value > value && scripts_size < best_script_size) {
            best_solution = individual;
            best_script_size = scripts_size;
        }
    }

    if (best_solution == [])
        createPopulation(utxos, defineNumGenes(utxos, outputs));

    return false
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

module.exports = function genetic (utxos, outputs, feeRate) {
    // Starts creating the initial population
    createPopulation(utxos, defineNumGenes(utxos, outputs));

    for (let i = 0; i < NUM_GENERATIONS; i++) {
        if (fitness(feeRate, utxos, outputs))
            break;
        mutation(utxos);
    }

    return utils.finalize(best_solution, outputs, feeRate);
}