import { formatLocalDate, formatLocalDateTime, formatPhone, maskPhone } from './format';

describe('format', () => {
  it('mascara telefone com 10 e 11 dígitos', () => {
    expect(maskPhone('(81) 9 9999-0000')).toBe('(81) 99999-0000'); // CA1-05
    expect(maskPhone('8133330000')).toBe('(81) 3333-0000');
    expect(maskPhone('81')).toBe('(81');
    expect(formatPhone('81999990000')).toBe('(81) 99999-0000');
    expect(formatPhone(null)).toBe('—');
  });

  it('a máscara de telefone não estoura com texto maior que o campo', () => {
    expect(maskPhone('(81) 99999-0000 ramal 12')).toBe('(81) 99999-0000');
    expect(maskPhone('')).toBe('');
  });

  it('formata LocalDate sem deslocar o dia pelo fuso', () => {
    expect(formatLocalDate('2026-12-09')).toBe('09/12/2026');
    expect(formatLocalDate(null)).toBe('—');
    expect(formatLocalDateTime('2026-11-26T10:05:33.123')).toBe('26/11/2026 10:05');
    expect(formatLocalDateTime('2026-11-26')).toBe('26/11/2026');
  });

  it('datas: virada de mês e de ano, e sem deslocar o dia (nada de Date/UTC)', () => {
    expect(formatLocalDate('2026-12-31')).toBe('31/12/2026');
    expect(formatLocalDate('2027-01-01')).toBe('01/01/2027');
    expect(formatLocalDate('2026-12-09T00:00:00')).toBe('09/12/2026');
    expect(formatLocalDateTime('2026-12-09T23:59:59')).toBe('09/12/2026 23:59');
    expect(formatLocalDateTime('2026-12-10T00:05:00')).toBe('10/12/2026 00:05');
    expect(formatLocalDate(undefined)).toBe('—');
    expect(formatLocalDate('')).toBe('—');
  });
});
