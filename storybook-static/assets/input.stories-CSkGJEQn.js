import{j as e}from"./iframe-DCrcDkvy.js";import"./preload-helper-Dp1pzeXC.js";function S({label:r,error:o,style:n,...c}){return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:6},children:[r&&e.jsx("label",{style:{fontSize:"var(--font-size-sm)",fontWeight:"var(--font-weight-medium)",color:"var(--color-text)"},children:r}),e.jsx("input",{style:{fontFamily:"var(--font-body)",fontSize:"var(--font-size-sm)",color:"var(--color-text)",background:"var(--color-muted)",border:`1.5px solid ${o?"var(--color-priority-urgent)":"var(--color-border)"}`,borderRadius:"var(--radius-lg)",padding:"11px 14px",width:"100%",outline:"none",transition:"all var(--transition-fast)",...n},...c}),o&&e.jsx("p",{style:{fontSize:"var(--font-size-xs)",color:"var(--color-priority-urgent)",margin:0},children:o})]})}function z({label:r,error:o,style:n,...c}){return e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:6},children:[r&&e.jsx("label",{style:{fontSize:"var(--font-size-sm)",fontWeight:"var(--font-weight-medium)",color:"var(--color-text)"},children:r}),e.jsx("textarea",{style:{fontFamily:"var(--font-body)",fontSize:"var(--font-size-sm)",color:"var(--color-text)",background:"var(--color-muted)",border:`1.5px solid ${o?"var(--color-priority-urgent)":"var(--color-border)"}`,borderRadius:"var(--radius-lg)",padding:"11px 14px",width:"100%",outline:"none",resize:"vertical",transition:"all var(--transition-fast)",...n},...c})]})}S.__docgenInfo={description:"",methods:[],displayName:"DsInput",props:{label:{required:!1,tsType:{name:"string"},description:""},error:{required:!1,tsType:{name:"string"},description:""}},composes:["InputHTMLAttributes"]};z.__docgenInfo={description:"",methods:[],displayName:"DsTextarea",props:{label:{required:!1,tsType:{name:"string"},description:""},error:{required:!1,tsType:{name:"string"},description:""}},composes:["TextareaHTMLAttributes"]};const I={title:"Design System/Input",component:S,tags:["autodocs"],argTypes:{label:{control:"text"},placeholder:{control:"text"},error:{control:"text"},disabled:{control:"boolean"}}},a={args:{placeholder:"Escribe algo..."}},t={args:{label:"Email",placeholder:"hola@ejemplo.com"}},s={args:{label:"Email",placeholder:"hola@ejemplo.com",error:"Email no válido"}},l={args:{placeholder:"Deshabilitado",disabled:!0}},i={name:"Textarea",render:()=>e.jsx(z,{label:"Descripción",placeholder:"Escribe aquí...",rows:4})};var d,p,m;a.parameters={...a.parameters,docs:{...(d=a.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    placeholder: 'Escribe algo...'
  }
}`,...(m=(p=a.parameters)==null?void 0:p.docs)==null?void 0:m.source}}};var u,g,x;t.parameters={...t.parameters,docs:{...(u=t.parameters)==null?void 0:u.docs,source:{originalSource:`{
  args: {
    label: 'Email',
    placeholder: 'hola@ejemplo.com'
  }
}`,...(x=(g=t.parameters)==null?void 0:g.docs)==null?void 0:x.source}}};var f,b,h;s.parameters={...s.parameters,docs:{...(f=s.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    label: 'Email',
    placeholder: 'hola@ejemplo.com',
    error: 'Email no válido'
  }
}`,...(h=(b=s.parameters)==null?void 0:b.docs)==null?void 0:h.source}}};var v,y,D;l.parameters={...l.parameters,docs:{...(v=l.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    placeholder: 'Deshabilitado',
    disabled: true
  }
}`,...(D=(y=l.parameters)==null?void 0:y.docs)==null?void 0:D.source}}};var T,j,E;i.parameters={...i.parameters,docs:{...(T=i.parameters)==null?void 0:T.docs,source:{originalSource:`{
  name: 'Textarea',
  render: () => <DsTextarea label="Descripción" placeholder="Escribe aquí..." rows={4} />
}`,...(E=(j=i.parameters)==null?void 0:j.docs)==null?void 0:E.source}}};const W=["Default","WithLabel","WithError","Disabled","TextareaStory"];export{a as Default,l as Disabled,i as TextareaStory,s as WithError,t as WithLabel,W as __namedExportsOrder,I as default};
