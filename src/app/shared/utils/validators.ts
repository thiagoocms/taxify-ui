import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
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
