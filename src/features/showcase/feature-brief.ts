import { defineForm } from '../api';
import featureBrief from './forms/feature-brief.json';

/** Example data-driven form: the JSON file is the whole definition; an invalid file fails at load. */
export const featureBriefForm = defineForm(featureBrief);
