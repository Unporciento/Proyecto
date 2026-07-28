export class BuenaventuraProvider {
  constructor({ external = false } = {}) {
    this.external = external;
  }

  async recommend() {
    throw new Error('El proveedor debe implementar recommend(request, options).');
  }
}
