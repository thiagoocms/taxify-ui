import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorCode, httpStatusOf, planLimitMessage, planLimitSentence, planNameInSentence, withJsonErrorBody } from './api-error.model';

describe('api-error.model (texto do limite do teste)', () => {
  it('nome do plano no meio da frase começa com minúscula', () => {
    expect(planNameInSentence('Teste grátis')).toBe('teste grátis');
    expect(planNameInSentence(null)).toBe('teste grátis');
  });

  it('frase da spec: "O teste grátis permite..."', () => {
    expect(planLimitSentence('COMPANY', 'Teste grátis', 5, 5)).toBe(
      'O teste grátis permite 5 empresas e o escritório já tem 5. Fale com a CS Hub para contratar.',
    );
    expect(planLimitSentence('USER', 'Teste grátis', 2, 2)).toBe(
      'O teste grátis permite 2 usuários e o escritório já tem 2. Fale com a CS Hub para contratar.',
    );
  });

  it('409 sem mensagem monta a frase; com mensagem, usa a da API', () => {
    expect(planLimitMessage({ code: 'error.plan.limit.users', limit: 2, inUse: 2, planName: 'Teste grátis' })).toContain(
      'O teste grátis permite 2 usuários',
    );
    expect(planLimitMessage({ message: 'Texto da API.' })).toBe('Texto da API.');
  });
});

describe('withJsonErrorBody', () => {
  it('lê o corpo Blob do erro (CSV) e devolve o code; corpo que não é JSON fica como veio', async () => {
    const json = new HttpErrorResponse({ status: 403, error: new Blob([JSON.stringify({ code: 'error.firm.access.blocked', message: 'Somente leitura.' })]) });
    const read = await withJsonErrorBody(json);
    expect(apiErrorCode(read)).toBe('error.firm.access.blocked');
    expect(httpStatusOf(read)).toBe(403);
    const text = new HttpErrorResponse({ status: 500, error: new Blob(['erro']) });
    expect(await withJsonErrorBody(text)).toBe(text);
    expect(await withJsonErrorBody('x')).toBe('x');
  });
});
