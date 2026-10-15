"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualUVCSProvider = void 0;
class ManualUVCSProvider {
    name = 'manual';
    async getStatus() {
        return {
            status: 'manual_mode',
            message: 'Operating in manual changeset linking mode. Changesets are recorded manually by developers.',
            provider: 'Manual / Plastic SCM Interface',
            organization: 'cindermarch',
            repository: 'Terminal6-Main',
            lastChecked: new Date().toISOString()
        };
    }
    async testConnection() {
        const hasCloudToken = !!process.env.UNITY_DEVOPS_TOKEN;
        const hasCmCli = false; // We can check exec('cm version') safely
        if (!hasCloudToken && !hasCmCli) {
            return {
                status: 'manual_mode',
                message: 'No active Unity DevOps API token or local Plastic SCM (cm) CLI detected. Studio is currently operating in manual mode.',
                provider: 'Manual Provider',
                organization: 'cindermarch',
                repository: 'Terminal6-Main',
                lastChecked: new Date().toISOString(),
                errorDetail: 'To enable automated synchronization, install the Unity Version Control CLI (cm) or provide UNITY_DEVOPS_TOKEN and UNITY_ORGANIZATION_ID in server environment variables.'
            };
        }
        return {
            status: 'manual_mode',
            message: 'Manual provider active. Live synchronization requires full Plastic SCM auth token configuration.',
            provider: 'Manual Provider',
            lastChecked: new Date().toISOString()
        };
    }
    async lookupChangeset(_repositoryId, _changesetId) {
        // In manual mode, we do not fabricate live lookups
        return null;
    }
}
exports.ManualUVCSProvider = ManualUVCSProvider;
