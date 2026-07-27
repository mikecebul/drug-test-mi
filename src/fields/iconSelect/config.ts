import { TextField } from 'payload'

export const iconSelect: TextField = {
  name: 'icon',
  type: 'text',
  label: 'Icon',
  admin: {
    width: '50%',
    components: {
      Field: '@/fields/iconSelect/Component',
    },
  },
}
