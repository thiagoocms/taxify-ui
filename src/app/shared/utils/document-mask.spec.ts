import { isValidCnpj, isValidCpf, maskCnpj, maskCpf } from './document-mask';

// Números fictícios de teste (DV válido), nenhum dado real.
describe('document-mask', () => {
  it('confere o DV do CNPJ (com ou sem máscara)', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBeTrue();
    expect(isValidCnpj('11222333000181')).toBeTrue();
    expect(isValidCnpj('11.111.111/0001-11')).toBeFalse(); // CA1-04
    expect(isValidCnpj('11.222.333/0001-82')).toBeFalse();
    expect(isValidCnpj('00000000000000')).toBeFalse();
    expect(isValidCnpj('1122233300018')).toBeFalse();
  });

  it('CNPJ: sequências repetidas, tamanho errado, letras e vazio são inválidos; outro CNPJ fictício válido passa', () => {
    ['11111111111111', '99999999999999', '1122233300018', '112223330001811', 'abcdefghijklmn', ''].forEach((value) =>
      expect(isValidCnpj(value)).withContext(value).toBeFalse(),
    );
    expect(isValidCnpj('45.723.174/0001-10')).toBeTrue();
    expect(isValidCnpj('07526557000100')).toBeTrue();
  });

  it('confere o DV do CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBeTrue();
    expect(isValidCpf('529.982.247-24')).toBeFalse();
    expect(isValidCpf('111.111.111-11')).toBeFalse();
  });

  it('CPF: sequências repetidas e tamanho errado são inválidos', () => {
    ['00000000000', '99999999999', '5299822472', '529982247250', ''].forEach((value) =>
      expect(isValidCpf(value)).withContext(value).toBeFalse(),
    );
  });

  it('mascara CNPJ e CPF enquanto digita', () => {
    expect(maskCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(maskCnpj('1122233')).toBe('11.222.33');
    expect(maskCpf('52998224725')).toBe('529.982.247-25');
  });

  it('a máscara de CNPJ não estoura com colagem maior que o campo e ignora letras', () => {
    expect(maskCnpj('11222333000181999')).toBe('11.222.333/0001-81');
    expect(maskCnpj('11a222b333')).toBe('11.222.333');
  });
});
