import { systemRepository } from '../../repositories/system/system.repository';

export const systemService = {
  async getSeedStatus() {
    return systemRepository.getSeedStatus();
  },
};
