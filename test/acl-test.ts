import { describe, it, expect } from 'bun:test';
import { VCLCompiler } from '../src/vcl-compiler';
import { VCLProgram } from '../src/vcl-ast';
import { ACLEntry } from '../src/vcl-types';

describe('ACL Tests', () => {
  it('should compile a VCL program with ACL declarations', () => {
    const program: VCLProgram = {
      acls: [
        {
          name: 'trusted_ips',
          entries: [
            { ip: '192.168.0.0', subnet: 24 },
            { ip: '10.0.0.0', subnet: 8 }
          ]
        }
      ],
      subroutines: [
        {
          name: 'vcl_recv',
          statements: [
            {
              type: 'IfStatement',
              condition: {
                type: 'BinaryExpression',
                operator: '~',
                left: { type: 'Identifier', name: 'client.ip' },
                right: { type: 'Identifier', name: 'trusted_ips' }
              },
              consequent: [
                {
                  type: 'SetStatement',
                  target: 'req.http.X-Trusted',
                  value: { type: 'StringLiteral', value: 'true' }
                }
              ],
              alternate: [
                {
                  type: 'SetStatement',
                  target: 'req.http.X-Trusted',
                  value: { type: 'StringLiteral', value: 'false' }
                }
              ]
            },
            {
              type: 'ReturnStatement',
              action: 'lookup'
            }
          ]
        }
      ]
    };

    const compiler = new VCLCompiler(program);
    const subroutines = compiler.compile();

    // Check that the subroutines were compiled correctly
    expect(subroutines).toBeDefined();
    expect(subroutines.vcl_recv).toBeDefined();
  });

  it('should correctly evaluate ACL membership', () => {
    const program: VCLProgram = {
      acls: [
        {
          name: 'trusted_ips',
          entries: [
            { ip: '192.168.0.0', subnet: 24 },
            { ip: '10.0.0.0', subnet: 8 }
          ]
        }
      ],
      subroutines: [
        {
          name: 'vcl_recv',
          statements: [
            {
              type: 'IfStatement',
              condition: {
                type: 'BinaryExpression',
                operator: '~',
                left: { type: 'Identifier', name: 'client.ip' },
                right: { type: 'Identifier', name: 'trusted_ips' }
              },
              consequent: [
                {
                  type: 'SetStatement',
                  target: 'req.http.X-Trusted',
                  value: { type: 'StringLiteral', value: 'true' }
                }
              ],
              alternate: [
                {
                  type: 'SetStatement',
                  target: 'req.http.X-Trusted',
                  value: { type: 'StringLiteral', value: 'false' }
                }
              ]
            },
            {
              type: 'ReturnStatement',
              action: 'lookup'
            }
          ]
        }
      ]
    };

    const compiler = new VCLCompiler(program);
    const subroutines = compiler.compile();

    // Test with an IP in the ACL
    const context1 = {
      req: { http: {} },
      client: { ip: '192.168.0.10' }
    };
    subroutines.vcl_recv(context1);
    expect(context1.req.http['X-Trusted']).toBe('true');

    // Test with an IP not in the ACL
    const context2 = {
      req: { http: {} },
      client: { ip: '172.16.0.1' }
    };
    subroutines.vcl_recv(context2);
    expect(context2.req.http['X-Trusted']).toBe('false');
  });
});
