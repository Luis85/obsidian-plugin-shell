/** Optional dependency-injection seam; Faker is tooling-only, never a production import. */
export function createFakerProvider(faker, version) {
  if (version !== '10.5.0') throw new Error('Requalify and pin the Faker version before changing fixture identities.');
  return ({ seed, kind, referenceDate }) => {
    faker.seed(seed); faker.setDefaultRefDate(referenceDate);
    if (kind === 'name') return faker.person.fullName();
    // Synthetic, reserved-domain addresses: never addresses which could be contacted.
    if (kind === 'email') return 'fixture-' + faker.string.alphanumeric(12).toLowerCase() + '@example.invalid';
    throw new Error('Provider is not in the supported allowlist.');
  };
}
