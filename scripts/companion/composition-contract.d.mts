/** Types for the shared data-only JavaScript composition engine. */
export type CompositionState = 'default' | 'loading' | 'empty' | 'error' | 'disabled';
export interface CompositionSession { state: CompositionState; width: 'wide' | 'narrow'; values: Record<string, unknown>; bindings: {sourceId:string;operationId:string;value:unknown}[]; hidden: Record<string, boolean>; focused:string|null; emitted:{name:string;source:string;payload?:string|number|boolean}[]; navigation:string|null }
export interface CompositionUI {gap:number;padding:number;columns:number;align:'start'|'center'|'end'|'stretch';justify:'start'|'center'|'end'|'space-between';wrap:boolean;overflow:'visible'|'auto'|'hidden';widthMode:'fill'|'hug'|'fixed';width:number;minWidth:number;maxWidth:number;narrow:{layout:'stack'|'row'|'grid';columns:number;hidden:boolean};tokens:{gap:string;padding:string;color:string;background:string;radius:string;typography:string}}
export const COMPOSITION_CONTROLS: readonly string[];
export function compositionDefaultUI(): CompositionUI;
export function compositionLiteral(value:unknown):unknown;
export function validateCompositionUI(value:unknown):void;
export function validateCompositionNode(value:unknown):void;
export function validateCompositionEffect(edge:unknown,document:unknown):void;
export function validateCompositionScenarios(document:unknown):void;
export function validateCompositionDesignSystem(system:unknown):void;
export function compositionRead(value:unknown,field:string):unknown;
export function compositionVisible(document:unknown,session:Pick<CompositionSession,'state'> & Partial<CompositionSession>,node:unknown):boolean;
export function compositionSession(scenario?:unknown):CompositionSession;
export function compositionTransition(document:unknown,session:CompositionSession,edgeId:string):CompositionSession;
export function compositionStyle(node:unknown,system:unknown,narrow?:boolean):Record<string,string|number>;
export function compositionTheme(system:unknown,dark?:boolean):Record<string,string>;
export function compositionTestSource(document:unknown):string;
