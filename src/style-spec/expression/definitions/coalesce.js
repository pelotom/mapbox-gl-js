// @flow

const assert = require('assert');
const Assertion = require('./assertion');
const ArrayAssertion = require('./array');
const Coercion = require('./coercion');
const {ValueType} = require('../types');

import type { Expression } from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type { Type } from '../types';

class Coalesce implements Expression {
    type: Type;
    args: Array<Expression>;

    constructor(type: Type, args: Array<Expression>) {
        this.type = type;
        this.args = args;
    }

    static parse(args: Array<mixed>, context: ParsingContext) {
        if (args.length < 2) {
            return context.error("Expectected at least one argument.");
        }
        let outputType: Type = (null: any);
        if (context.expectedType && context.expectedType.kind !== 'value') {
            outputType = context.expectedType;
        }
        const parsedArgs = [];

        let needsOuterAnnotation = false;

        for (const arg of args.slice(1)) {
            let parsed = context.parse(arg, 1 + parsedArgs.length, outputType);
            if (!parsed) return null;
            outputType = outputType || parsed.type;

            // strip off any inferred type assertions so that they don't
            // produce a runtime error for `null` input, which would preempt
            // the desired null-coalescing behavior
            if ((parsed instanceof Assertion || parsed instanceof Coercion) &&
                parsed._inferred) {
                needsOuterAnnotation = true;
                parsed = parsed.args[0];
            } else if (parsed instanceof ArrayAssertion && parsed._inferred) {
                needsOuterAnnotation = true;
                parsed = parsed.input;
            }

            parsedArgs.push(parsed);
        }
        assert(outputType);
        return needsOuterAnnotation ?
            context.annotateType(outputType, new Coalesce(ValueType, parsedArgs)) :
            new Coalesce((outputType: any), parsedArgs);
    }

    evaluate(ctx: EvaluationContext) {
        let result = null;
        for (const arg of this.args) {
            result = arg.evaluate(ctx);
            if (result !== null) break;
        }
        return result;
    }

    eachChild(fn: (Expression) => void) {
        this.args.forEach(fn);
    }

    possibleOutputs() {
        return [].concat(...this.args.map((arg) => arg.possibleOutputs()));
    }
}

module.exports = Coalesce;
