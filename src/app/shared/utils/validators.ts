import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { isValidCnpj, isValidCpf, onlyDigits } from './document-mask';

/**
 * Validadores de CPF/CNPJ, telefone e senha (só ajudam o usuário: o backend é a fonte e recusa o que for inválido).
 * O texto de cada erro fica no app-input.
 */

/** Erro `cnpjInvalid` quando o valor preenchido não é um CNPJ com DV válido (vazio fica com o `required`). */
export const cnpjValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  !control.value || isValidCnpj(control.value) ? null : { cnpjInvalid: true };

export const cpfValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  !control.value || isValidCpf(control.value) ? null : { cpfInvalid: true };

/** DDD + número: 10 ou 11 dígitos. */
export const phoneValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const length = onlyDigits(control.value).length;
  return !control.value || length === 10 || length === 11 ? null : { phoneInvalid: true };
};

/**
 * Texto com no máximo `max` bytes em UTF-8 (a senha vai para o BCrypt, que só usa 72 bytes): erro `maxBytes`.
 * Acentos e emojis ocupam mais de um byte, por isso não dá para usar o maxLength.
 */
export function maxBytesValidator(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value : '';
    const bytes = new TextEncoder().encode(value).length;
    return bytes > max ? { maxBytes: { max, actual: bytes } } : null;
  };
}

/**
 * Validadores da senha nova (SN-RN-08): obrigatória, mínimo de `minLength` caracteres e no máximo 72 bytes. Sem regra
 * de composição. O `:` é permitido (o login divide "login:senha" só no primeiro `:`).
 */
export function newPasswordValidators(minLength: number, maxBytes = 72): ValidatorFn[] {
  return [Validators.required, Validators.minLength(minLength), maxBytesValidator(maxBytes)];
}

/**
 * Validador de grupo dos formulários de senha nova: marca `mismatch` na confirmação quando ela difere da senha nova e,
 * se o grupo tiver `current`, marca `samePassword` na senha nova quando ela é igual à atual. Os nomes dos controles
 * vêm por parâmetro; o erro some sozinho quando os valores deixam de bater.
 */
export function newPasswordGroupValidator(names: { password: string; confirm: string; current?: string }): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(names.password);
    const confirm = group.get(names.confirm);
    const current = names.current ? group.get(names.current) : null;
    if (!password || !confirm) {
      return null;
    }
    toggleError(confirm, 'mismatch', !!confirm.value && password.value !== confirm.value);
    if (current) {
      toggleError(password, 'samePassword', !!password.value && password.value === current.value);
    }
    return null;
  };
}

function toggleError(control: AbstractControl, key: string, on: boolean): void {
  if (on && !control.hasError(key)) {
    control.setErrors({ ...(control.errors ?? {}), [key]: true });
  } else if (!on && control.hasError(key)) {
    const { [key]: _removed, ...rest } = control.errors ?? {};
    control.setErrors(Object.keys(rest).length ? rest : null);
  }
}

/** Login novo sem `:` (o `:` separa login e senha no POST /auth; recomendação aceita no P-SN-10): erro `colon`. */
export const noColonValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.includes(':') ? { colon: true } : null;
