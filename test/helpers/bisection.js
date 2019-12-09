"use strict";


const bisection = {

    new: (lower, upper, factor=2) => {
        let value = isFinite(upper)
                  ? lower + upper >> 1
                  : lower;

        return increase => {
            if (increase) {
                lower = value;
                value = isFinite(upper)
                      ? value + upper >> 1
                      : value * factor || 1;
            } else {
                upper = value;
                value = lower + value >> 1;
            }

            return value != lower && value != upper
                 ? value
                 : undefined;
        };
    },

};


module.exports = bisection;

