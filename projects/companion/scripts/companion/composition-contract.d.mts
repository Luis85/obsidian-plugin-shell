/** Types for the shared data-only JavaScript composition engine. */
export type CompositionState = 'default' | 'loading' | 'empty' | 'error' | 'disabled';
export interface CompositionSession { state: CompositionState; width: 'wide' | 'narrow'; values: Record<string, unknown>; bindings: {sourceId:string;operationId:string;value:unknown}[]; hidden: Record<string, boolean>; focused:string|null; emitted:{name:string;source:string;payload?:string|number|boolean}[]; navigation:string|null }
export interface CompositionUI {gap:number;padding:number;columns:number;align:'start'|'center'|'end'|'stretch';justify:'start'|'center'|'end'|'space-between';wrap:boolean;overflow:'visible'|'auto'|'hidden';widthMode:'fill'|'hug'|'fixed';width:number;minWidth:number;maxWidth:number;narrow:{layout:'stack'|'row'|'grid';columns:number;hidden:boolean};tokens:{gap:string;padding:string;color:string;background:string;radius:string;typography:string}}
export declare const COMPOSITION_CONTROLS: readonly string[];
export declare function compositionDefaultUI(): CompositionUI;
export declare function compositionLiteral(value:unknown):unknown;
export declare function validateCompositionUI(value:unknown):void;
export declare function validateCompositionNode(value:unknown):void;
export declare function validateCompositionEffect(edge:unknown,document:unknown):void;
export declare function validateCompositionScenarios(document:unknown):void;
export declare function validateCompositionDesignSystem(system:unknown):void;
export declare function compositionRead(value:unknown,field:string):unknown;
export declare function compositionVisible(document:unknown,session:Pick<CompositionSession,'state'> & Partial<CompositionSession>,node:unknown):boolean;
export declare function compositionSession(scenario?:unknown):CompositionSession;
export declare function compositionTransition(document:unknown,session:CompositionSession,edgeId:string):CompositionSession;
export declare function compositionStyle(node:unknown,system:unknown,narrow?:boolean):Record<string,string|number>;
export declare function compositionTheme(system:unknown,dark?:boolean):Record<string,string>;
export declare function compositionTestSource(document:unknown):string;
