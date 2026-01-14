# Protocol Buffers (protos/)

Proto definitions for gRPC services, managed by Buf.

## Commands

```bash
ops build protos             # Generate all proto code (Python + TypeScript)
buf lint                     # Lint proto files
buf build                    # Build/validate protos
```

## Structure

```
protos/
  adksim/v1/
    simulator_service.proto  # Core service definition
    simulator_session.proto  # Session management
  google/                    # Vendored Google protos
  buf.yaml                   # Buf module config
  buf.gen.yaml               # Code generation config
```

## Generated Output

- Python: `packages/adk-sim-protos/src/adk_sim_protos/` (betterproto)
- TypeScript: `packages/adk-sim-protos-ts/src/` (bufbuild)

## Notes

- Always run `ops build protos` after modifying .proto files
- Generated code is committed to the repo
- Both Python and TypeScript packages are versioned together
