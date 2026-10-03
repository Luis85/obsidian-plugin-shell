import {$,announce,dialog,esc} from "./core.ts";

let returnFocus=null;
dialog.addEventListener("close",()=>{const target=returnFocus;returnFocus=null;if(target?.isConnected&&typeof target.focus==="function")window.setTimeout(()=>target.focus(),0);});

export function openDialog(title,body,onSubmit=null,submitText="Save",options={}) {
  if(!dialog.open)returnFocus=document.activeElement;
  const showSubmit=onSubmit!==null&&!options.hideSubmit;
  dialog.innerHTML=`<form id="dialog-form" novalidate><div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button type="button" data-dialog-close aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div><div class="dialog-foot">${options.extraFooter||""}<button type="button" data-dialog-close>${options.cancelText||"Close"}</button>${showSubmit?`<button class="primary" type="submit">${esc(submitText)}</button>`:""}</div></form>`;
  dialog.querySelectorAll("[data-dialog-close]").forEach(btn=>btn.addEventListener("click",()=>dialog.close()));
  const form=$("#dialog-form",dialog);
  if(onSubmit)form.addEventListener("submit",event=>{event.preventDefault();if(!form.reportValidity()){const invalid=form.querySelector(":invalid"),label=invalid?.labels?.[0]?.childNodes?.[0]?.textContent?.trim()||invalid?.getAttribute?.("aria-label")||invalid?.name||"Field";invalid?.focus?.();announce(`${label}: check the value and allowed range before saving.`);return;}const ok=onSubmit(new FormData(form),form);if(ok!==false)dialog.close();});
  if(!dialog.open)dialog.showModal();window.setTimeout(()=>dialog.querySelector("input,select,textarea,button")?.focus(),0);return form;
}
export function confirmDialog(title,message,onConfirm,confirmText="Confirm") {openDialog(title,`<div class="callout danger-callout">${esc(message)}</div>`,()=>{onConfirm();return true;},confirmText,{cancelText:"Cancel"});}
export function parseLines(text) { return String(text||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean); }
