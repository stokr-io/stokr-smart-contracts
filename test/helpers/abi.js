"use strict";


let contract = {

    getMethods: contract => {
        return contract.abi.filter(node => node.type === "function");
    },

    findMethod: (contract, definition) =>
        contract.abi.find(node =>
            node.name === definition.name
            && node.type === "function" && definition.type === "function"
            && node.name === definition.name
            && node.inputs.length === definition.inputs.length
            && node.inputs.every((param, i) => param.type === definition.inputs[i].type)
            && node.payable === definition.payable
            && node.stateMutability === definition.stateMutability
            && (node.outputs === undefined && definition.outputs === undefined
                || node.outputs.length === definition.outputs.length
                && node.outputs.every((param, i) => param.type === definition.outputs[i].type))),

};


module.exports = contract;

