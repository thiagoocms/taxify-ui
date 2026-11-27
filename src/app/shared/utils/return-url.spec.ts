import { returnUrlToKeep, safeReturnUrl } from './return-url';

describe('return-url', () => {
  it('guarda telas internas; ignora raiz, /auth e o callback do OAuth da Conta Azul', () => {
    expect(returnUrlToKeep('/pendencias?severidade=ALTA&status=ABERTA')).toBe('/pendencias?severidade=ALTA&status=ABERTA');
    expect(returnUrlToKeep('/minha-conta')).toBe('/minha-conta');
    expect(returnUrlToKeep('/')).toBeUndefined();
    expect(returnUrlToKeep('/auth/login')).toBeUndefined();
    expect(returnUrlToKeep('/integracoes/conta-azul/callback?code=abc&state=x')).toBeUndefined();
    expect(returnUrlToKeep(null)).toBeUndefined();
  });

  it('destino depois do login: só caminho interno; fora disso, /home', () => {
    expect(safeReturnUrl('/minha-conta')).toBe('/minha-conta');
    expect(safeReturnUrl('//site-ficticio.example')).toBe('/home');
    expect(safeReturnUrl('https://site-ficticio.example')).toBe('/home');
    expect(safeReturnUrl('/\\site-ficticio.example')).toBe('/home');
    expect(safeReturnUrl('/auth/register')).toBe('/home');
    expect(safeReturnUrl('/integracoes/conta-azul/callback?code=abc')).toBe('/home');
    expect(safeReturnUrl(undefined)).toBe('/home');
  });
});
