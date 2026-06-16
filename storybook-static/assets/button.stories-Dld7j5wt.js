import{j as r}from"./iframe-DCrcDkvy.js";import{D as e}from"./button-C7vNkC8I.js";import"./preload-helper-Dp1pzeXC.js";const A={title:"Design System/Button",component:e,tags:["autodocs"],argTypes:{variant:{control:"select",options:["primary","secondary","outline","ghost"]},size:{control:"select",options:["sm","md","lg"]},children:{control:"text"}}},s={args:{children:"Primary",variant:"primary"}},a={args:{children:"Secondary",variant:"secondary"}},t={args:{children:"Outline",variant:"outline"}},n={args:{children:"Ghost",variant:"ghost"}},o={render:()=>r.jsxs("div",{style:{display:"flex",gap:12,alignItems:"center"},children:[r.jsx(e,{size:"sm",children:"Small"}),r.jsx(e,{size:"md",children:"Medium"}),r.jsx(e,{size:"lg",children:"Large"})]})},i={render:()=>r.jsxs("div",{style:{display:"flex",gap:12,flexWrap:"wrap"},children:[r.jsx(e,{variant:"primary",children:"Primary"}),r.jsx(e,{variant:"secondary",children:"Secondary"}),r.jsx(e,{variant:"outline",children:"Outline"}),r.jsx(e,{variant:"ghost",children:"Ghost"})]})};var c,d,l;s.parameters={...s.parameters,docs:{...(c=s.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    children: 'Primary',
    variant: 'primary'
  }
}`,...(l=(d=s.parameters)==null?void 0:d.docs)==null?void 0:l.source}}};var m,p,u;a.parameters={...a.parameters,docs:{...(m=a.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    children: 'Secondary',
    variant: 'secondary'
  }
}`,...(u=(p=a.parameters)==null?void 0:p.docs)==null?void 0:u.source}}};var g,y,h;t.parameters={...t.parameters,docs:{...(g=t.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    children: 'Outline',
    variant: 'outline'
  }
}`,...(h=(y=t.parameters)==null?void 0:y.docs)==null?void 0:h.source}}};var v,x,D;n.parameters={...n.parameters,docs:{...(v=n.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    children: 'Ghost',
    variant: 'ghost'
  }
}`,...(D=(x=n.parameters)==null?void 0:x.docs)==null?void 0:D.source}}};var S,B,j;o.parameters={...o.parameters,docs:{...(S=o.parameters)==null?void 0:S.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: 12,
    alignItems: 'center'
  }}>
      <DsButton size="sm">Small</DsButton>
      <DsButton size="md">Medium</DsButton>
      <DsButton size="lg">Large</DsButton>
    </div>
}`,...(j=(B=o.parameters)==null?void 0:B.docs)==null?void 0:j.source}}};var f,z,O;i.parameters={...i.parameters,docs:{...(f=i.parameters)==null?void 0:f.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap'
  }}>
      <DsButton variant="primary">Primary</DsButton>
      <DsButton variant="secondary">Secondary</DsButton>
      <DsButton variant="outline">Outline</DsButton>
      <DsButton variant="ghost">Ghost</DsButton>
    </div>
}`,...(O=(z=i.parameters)==null?void 0:z.docs)==null?void 0:O.source}}};const E=["Primary","Secondary","Outline","Ghost","Sizes","AllVariants"];export{i as AllVariants,n as Ghost,t as Outline,s as Primary,a as Secondary,o as Sizes,E as __namedExportsOrder,A as default};
