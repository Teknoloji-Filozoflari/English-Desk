import {fileURLToPath} from 'node:url';
import {createStore} from './notebook-store.mjs';
import {fillExamples} from './word-examples.mjs';
console.log(JSON.stringify(await fillExamples(createStore(fileURLToPath(new URL('../data/',import.meta.url))),undefined,progress=>console.log(JSON.stringify(progress)))));
