import{j as r}from"./iframe-DCrcDkvy.js";import{D as c}from"./card-DKqYyzPM.js";import{D as t}from"./badge-_HTUto3p.js";import"./preload-helper-Dp1pzeXC.js";const f={title:"Design System/Card",component:c,tags:["autodocs"],argTypes:{padding:{control:"select",options:["sm","md","lg"]},hover:{control:"boolean"}}},e={args:{children:"This is a card with default padding."}},a={render:()=>r.jsxs(c,{padding:"lg",style:{maxWidth:320},children:[r.jsx("div",{style:{width:"100%",height:120,borderRadius:"var(--radius-lg)",background:"linear-gradient(135deg, var(--color-brand), #4A0E0E)",marginBottom:12}}),r.jsx("h3",{style:{fontFamily:"var(--font-heading)",fontSize:16,fontWeight:700,color:"var(--color-text)",margin:"0 0 6px"},children:"Card Title"}),r.jsx("p",{style:{fontSize:13,color:"var(--color-text-secondary)",lineHeight:1.5,margin:"0 0 12px"},children:"Description of the card content goes here."}),r.jsxs("div",{style:{display:"flex",gap:6},children:[r.jsx(t,{variant:"primary",children:"Tag"}),r.jsx(t,{variant:"neutral",children:"Info"})]})]})};var o,i,n;e.parameters={...e.parameters,docs:{...(o=e.parameters)==null?void 0:o.docs,source:{originalSource:`{
  args: {
    children: 'This is a card with default padding.'
  }
}`,...(n=(i=e.parameters)==null?void 0:i.docs)==null?void 0:n.source}}};var s,d,l;a.parameters={...a.parameters,docs:{...(s=a.parameters)==null?void 0:s.docs,source:{originalSource:`{
  render: () => <DsCard padding="lg" style={{
    maxWidth: 320
  }}>
      <div style={{
      width: '100%',
      height: 120,
      borderRadius: 'var(--radius-lg)',
      background: 'linear-gradient(135deg, var(--color-brand), #4A0E0E)',
      marginBottom: 12
    }} />
      <h3 style={{
      fontFamily: 'var(--font-heading)',
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--color-text)',
      margin: '0 0 6px'
    }}>Card Title</h3>
      <p style={{
      fontSize: 13,
      color: 'var(--color-text-secondary)',
      lineHeight: 1.5,
      margin: '0 0 12px'
    }}>Description of the card content goes here.</p>
      <div style={{
      display: 'flex',
      gap: 6
    }}>
        <DsBadge variant="primary">Tag</DsBadge>
        <DsBadge variant="neutral">Info</DsBadge>
      </div>
    </DsCard>
}`,...(l=(d=a.parameters)==null?void 0:d.docs)==null?void 0:l.source}}};const x=["Default","WithContent"];export{e as Default,a as WithContent,x as __namedExportsOrder,f as default};
