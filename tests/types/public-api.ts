// Compile-only checks of the published type declarations.
import {
  createValidator, required, email, object, each, custom, matchesField, requiredIf, anyOf,
  type ValidationResult, type Validator,
} from '../../dist/index.js'

interface Address { zip: string }
interface User { name: string; address: Address; history: Address[]; confirm: string }

const address: Validator<Address> = createValidator<Address>({
  zip: [required(), custom<Address>((_value, data) => data.zip !== '', 'm')],
})

const user = createValidator<User>({
  name: [required(), anyOf<User>([email()])],
  address: [required(), object(address)],
  history: [each(address)],
  confirm: [matchesField<User>('name'), requiredIf<User>(data => data.name === 'x')],
})

createValidator<User>({ name: Math.random() > 0.5 ? [required()] : undefined })

const result: ValidationResult = user.validate({ name: 'a' })
if (!result.valid) {
  const name: string = result.firstError.name
  void name
} else {
  const none: null = result.firstError
  void none
}

// @ts-expect-error unknown rule key
createValidator<Address>({ unknown: [required()] })
// @ts-expect-error unknown comparison field
matchesField<User>('unknown')
// @ts-expect-error object() takes a validator, not a rule list
object([required()])
// @ts-expect-error custom() requires a message
custom(() => true)
// @ts-expect-error validate() checks known property types
address.validate({ zip: 1 })
