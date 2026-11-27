import { FormControl } from '@angular/forms';
import { cnpjValidator, cpfValidator, maxBytesValidator, phoneValidator } from './validators';

// CA1-04, CA1-05, CT1-08, CT1-09. Só números fictícios.
describe('validators', () => {
  it('CPF/CNPJ: vazio deixa o required decidir; valor ruim marca o erro certo', () => {
    expect(cnpjValidator(new FormControl(''))).toBeNull();
    expect(cnpjValidator(new FormControl('11.111.111/0001-11'))).toEqual({ cnpjInvalid: true });
    expect(cnpjValidator(new FormControl('11.222.333/0001-81'))).toBeNull();
    expect(cpfValidator(new FormControl('529.982.247-24'))).toEqual({ cpfInvalid: true });
    expect(cpfValidator(new FormControl('529.982.247-25'))).toBeNull();
  });

  it('telefone: 10 e 11 dígitos passam (com qualquer máscara); 8, 9 e 12 dígitos não (CT1-09)', () => {
    expect(phoneValidator(new FormControl('(81) 9 9999-0000'))).toBeNull();
    expect(phoneValidator(new FormControl('(81) 3333-0000'))).toBeNull();
    expect(phoneValidator(new FormControl('9999-0000'))).toEqual({ phoneInvalid: true });
    expect(phoneValidator(new FormControl('99999-0000'))).toEqual({ phoneInvalid: true });
    expect(phoneValidator(new FormControl('558199999000012'))).toEqual({ phoneInvalid: true });
  });

  it('senha: o limite é em bytes UTF-8 (acento e emoji pesam mais de 1)', () => {
    const validator = maxBytesValidator(72);
    expect(validator(new FormControl('a'.repeat(72)))).toBeNull();
    expect(validator(new FormControl('a'.repeat(73)))).not.toBeNull();
    expect(validator(new FormControl('ç'.repeat(36)))).toBeNull(); // 72 bytes
    expect(validator(new FormControl('ç'.repeat(37)))).not.toBeNull(); // 74 bytes
    expect(validator(new FormControl('😀'.repeat(19)))).not.toBeNull(); // 76 bytes
  });
});
