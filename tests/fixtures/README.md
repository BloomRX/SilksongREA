# Fixtures de teste

`managed-global-fixture.b64` é um PE/CLI sintético de 4 KiB, codificado em Base64 apenas para não versionar um binário. Ele declara o tipo global `HeroController` e o método `Jump`, sem conter qualquer código ou recurso do Silksong.

A fixture foi produzida por `buildManagedPeFixture`, do projeto MIT [morluto/rea](https://github.com/morluto/rea), arquivo `src/dotnet/ManagedPe.fixture.ts`. O aviso de copyright e a licença estão em [`LICENSE.rea.txt`](LICENSE.rea.txt).
