'use client'

import { lucideIcons } from '@/components/Icons'
import { Icon } from '@/components/Icons/Icon'
import { FieldError, FieldLabel, ReactSelect, useField } from '@payloadcms/ui'
import type { ReactSelectOption } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import { components, type OptionProps, type SingleValueProps } from 'react-select'
import { useCallback, useMemo, type CSSProperties } from 'react'

import './index.scss'

type IconOption = ReactSelectOption<string> & {
  label: string
  value: string
}

const IconOptionRow = ({ children, ...props }: OptionProps<IconOption, false>) => (
  <components.Option {...props}>
    <span className="icon-select__option">
      <Icon name={props.data.value} className="icon-select__icon" />
      <span className="icon-select__option-label">{children}</span>
    </span>
  </components.Option>
)

const IconSingleValue = ({ children, ...props }: SingleValueProps<IconOption, false>) => (
  <components.SingleValue {...props}>
    <span className="icon-select__value">
      <Icon name={props.data.value} className="icon-select__icon" />
      <span className="icon-select__option-label">{children}</span>
    </span>
  </components.SingleValue>
)

const IconSelect: TextFieldClientComponent = ({ field, path, readOnly, validate }) => {
  const { setValue, showError, value } = useField<string>({ path, validate })
  const inputID = `icon-select-${path.replace(/\./g, '__')}`
  const options = useMemo<IconOption[]>(
    () =>
      lucideIcons.map((icon) => ({
        label: icon.label,
        value: icon.value,
      })),
    [],
  )
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )
  const onChange = useCallback(
    (option: ReactSelectOption | ReactSelectOption[]) => {
      const nextValue = Array.isArray(option) ? null : option?.value
      setValue(typeof nextValue === 'string' ? nextValue : null)
    },
    [setValue],
  )

  return (
    <div
      className={`field-type select icon-select${showError ? ' error' : ''}`}
      id={`field-${path.replace(/\./g, '__')}`}
      style={
        {
          '--icon-select-width': field.admin?.width ?? '100%',
        } as CSSProperties
      }
    >
      <FieldLabel
        htmlFor={inputID}
        label={field.label}
        path={path}
        required={field.required}
      />
      <div className="field-type__wrap">
        <FieldError path={path} showError={showError} />
        <ReactSelect
          components={{
            Option: IconOptionRow,
            SingleValue: IconSingleValue,
          }}
          disabled={readOnly}
          inputId={inputID}
          isClearable
          onChange={onChange}
          options={options}
          placeholder="Select an icon"
          showError={showError}
          value={selectedOption ?? undefined}
        />
      </div>
    </div>
  )
}

export default IconSelect
