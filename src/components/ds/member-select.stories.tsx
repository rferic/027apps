import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { MemberSelect } from './member-select'

const meta = {
  component: MemberSelect,
  tags: ['ai-generated'],
  argTypes: {
    value: { control: 'text' },
    placeholder: { control: 'text' },
  },
} satisfies Meta<typeof MemberSelect>

export default meta
type Story = StoryObj<typeof meta>

const mockMembers = [
  { id: '1', display_name: 'Alice' },
  { id: '2', display_name: 'Bob' },
  { id: '3', display_name: 'Charlie' },
  { id: '4', display_name: 'Diana' },
]

export const Default: Story = {
  args: {
    members: mockMembers,
    value: '',
    placeholder: 'Selecciona un miembro...',
    onChange: () => {},
  },
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText('Selecciona un miembro...')
    await expect(input).toBeVisible()
  },
}

export const WithPreselected: Story = {
  args: {
    members: mockMembers,
    value: '2',
    placeholder: 'Selecciona...',
    onChange: () => {},
  },
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText('Selecciona...')
    await expect(input).toHaveValue('Bob')
  },
}

export const SearchAndSelect: Story = {
  args: {
    members: mockMembers,
    value: '',
    placeholder: 'Buscar...',
    onChange: () => {},
  },
  play: async ({ canvas, userEvent: ue }) => {
    const input = canvas.getByPlaceholderText('Buscar...')
    await ue.click(input)
    await ue.type(input, 'char')
    const option = canvas.getByText('Charlie')
    await expect(option).toBeVisible()
  },
}

export const WithCustomIdKey: Story = {
  args: {
    members: [
      { id: 'u1', display_name: 'Eric' },
      { id: 'u2', display_name: 'Maria' },
    ],
    value: 'u1',
    idKey: 'id',
    placeholder: 'Selecciona...',
    onChange: () => {},
  },
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText('Selecciona...')
    await expect(input).toHaveValue('Eric')
  },
}
