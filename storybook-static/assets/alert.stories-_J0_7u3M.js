import{j as e}from"./iframe-DCrcDkvy.js";import"./preload-helper-Dp1pzeXC.js";const C={success:{bg:"#ECFDF5",color:"#059669",border:"#A7F3D0",defaultIcon:"✅"},warning:{bg:"#FFFBEB",color:"#D97706",border:"#FDE68A",defaultIcon:"⚠️"},error:{bg:"#FEF2F2",color:"#DC2626",border:"#FECACA",defaultIcon:"❌"},info:{bg:"var(--color-brand-soft)",color:"var(--color-brand)",border:"var(--color-brand)",defaultIcon:"ℹ️"}};function r({children:k,variant:E="info",icon:I,onDismiss:c}){const s=C[E];return e.jsxs("div",{role:"alert",style:{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 16px",borderRadius:"var(--radius-lg)",background:s.bg,color:s.color,border:`1px solid ${s.border}`,fontFamily:"var(--font-body)",fontSize:"var(--font-size-sm)",lineHeight:1.5},children:[e.jsx("span",{style:{fontSize:16,flexShrink:0},children:I||s.defaultIcon}),e.jsx("div",{style:{flex:1},children:k}),c&&e.jsx("button",{onClick:c,style:{background:"none",border:"none",cursor:"pointer",color:s.color,fontSize:14,padding:0,flexShrink:0},"aria-label":"Dismiss",children:"✕"})]})}r.__docgenInfo={description:"",methods:[],displayName:"DsAlert",props:{children:{required:!0,tsType:{name:"ReactNode"},description:""},variant:{required:!1,tsType:{name:"union",raw:"'success' | 'warning' | 'error' | 'info'",elements:[{name:"literal",value:"'success'"},{name:"literal",value:"'warning'"},{name:"literal",value:"'error'"},{name:"literal",value:"'info'"}]},description:"",defaultValue:{value:"'info'",computed:!1}},icon:{required:!1,tsType:{name:"string"},description:""},onDismiss:{required:!1,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""}}};const z={title:"Design System/Alert",component:r,tags:["autodocs"],argTypes:{variant:{control:"select",options:["success","warning","error","info"]}}},a={args:{children:"This is an informational message.",variant:"info"}},n={args:{children:"Task completed successfully!",variant:"success"}},i={args:{children:"Please review your settings before continuing.",variant:"warning"}},o={args:{children:"Something went wrong. Please try again.",variant:"error"}},t={render:()=>e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:8},children:[e.jsx(r,{variant:"info",children:"This is an informational message."}),e.jsx(r,{variant:"success",children:"Task completed successfully!"}),e.jsx(r,{variant:"warning",children:"Please review your settings."}),e.jsx(r,{variant:"error",children:"Something went wrong."})]})},l={render:()=>e.jsx(r,{variant:"info",onDismiss:()=>alert("Dismissed!"),children:"Click the X to dismiss this alert."})};var d,u,m;a.parameters={...a.parameters,docs:{...(d=a.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    children: 'This is an informational message.',
    variant: 'info'
  }
}`,...(m=(u=a.parameters)==null?void 0:u.docs)==null?void 0:m.source}}};var g,p,f;n.parameters={...n.parameters,docs:{...(g=n.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    children: 'Task completed successfully!',
    variant: 'success'
  }
}`,...(f=(p=n.parameters)==null?void 0:p.docs)==null?void 0:f.source}}};var v,h,y;i.parameters={...i.parameters,docs:{...(v=i.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    children: 'Please review your settings before continuing.',
    variant: 'warning'
  }
}`,...(y=(h=i.parameters)==null?void 0:h.docs)==null?void 0:y.source}}};var D,x,b;o.parameters={...o.parameters,docs:{...(D=o.parameters)==null?void 0:D.docs,source:{originalSource:`{
  args: {
    children: 'Something went wrong. Please try again.',
    variant: 'error'
  }
}`,...(b=(x=o.parameters)==null?void 0:x.docs)==null?void 0:b.source}}};var w,A,S;t.parameters={...t.parameters,docs:{...(w=t.parameters)==null?void 0:w.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  }}>
      <DsAlert variant="info">This is an informational message.</DsAlert>
      <DsAlert variant="success">Task completed successfully!</DsAlert>
      <DsAlert variant="warning">Please review your settings.</DsAlert>
      <DsAlert variant="error">Something went wrong.</DsAlert>
    </div>
}`,...(S=(A=t.parameters)==null?void 0:A.docs)==null?void 0:S.source}}};var T,j,F;l.parameters={...l.parameters,docs:{...(T=l.parameters)==null?void 0:T.docs,source:{originalSource:`{
  render: () => <DsAlert variant="info" onDismiss={() => alert('Dismissed!')}>
      Click the X to dismiss this alert.
    </DsAlert>
}`,...(F=(j=l.parameters)==null?void 0:j.docs)==null?void 0:F.source}}};const _=["Info","Success","Warning","Error","AllVariants","Dismissible"];export{t as AllVariants,l as Dismissible,o as Error,a as Info,n as Success,i as Warning,_ as __namedExportsOrder,z as default};
