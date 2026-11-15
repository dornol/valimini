import './style.css'
import { createValidator, required, email, minLength, matchesField, time, afterTime, beforeTime, each, minItems } from './index'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main>
    <h1>valimini</h1>
    <p>객체를 검증하고, 첫 오류를 알린 뒤 해당 입력으로 이동합니다.</p>
    <form id="signup" novalidate>
      <label>이메일<input name="email" autocomplete="email"></label>
      <label>비밀번호<input name="password" type="password" autocomplete="new-password"></label>
      <label>비밀번호 확인<input name="passwordConfirm" type="password" autocomplete="new-password"></label>
      <label>연락 시간<input name="contactTime" type="time"></label>
      <label>추가 이메일 1<input name="emails[0]" autocomplete="email"></label>
      <label>추가 이메일 2<input name="emails[1]" autocomplete="email"></label>
      <button type="submit">검증하기</button>
    </form>
    <p id="status" role="status"></p>
    <details><summary>검증 결과</summary><pre id="result">아직 검증하지 않았습니다.</pre></details>
  </main>
`

const validator = createValidator({
  email: [required('이메일을 입력해주세요.'), email()],
  password: [required('비밀번호를 입력해주세요.'), minLength(8)],
  contactTime: [time(), afterTime('09:00'), beforeTime('18:00')],
  emails: [minItems(1), each([required('추가 이메일을 입력해주세요.'), email()])],
  passwordConfirm: [
    required('비밀번호 확인을 입력해주세요.'),
    matchesField('password', '비밀번호가 일치하지 않습니다.'),
  ],
})

const form = document.querySelector<HTMLFormElement>('#signup')!
form.addEventListener('submit', event => {
  event.preventDefault()
  const formData = new FormData(form)
  const result = validator.validate({
    ...Object.fromEntries(formData),
    emails: [formData.get('emails[0]'), formData.get('emails[1]')],
  })
  document.querySelector('#result')!.textContent = JSON.stringify(result, null, 2)
  document.querySelector('#status')!.textContent = result.valid ? '검증을 통과했습니다.' : ''
  if (!result.valid) {
    alert(result.firstError.message)
    const input = form.elements.namedItem(result.firstError.name)
    if (input instanceof HTMLElement) input.focus()
  }
})
