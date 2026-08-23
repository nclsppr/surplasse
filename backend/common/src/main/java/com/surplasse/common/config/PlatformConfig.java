package com.surplasse.common.config;

import io.smallrye.config.ConfigMapping;
import java.net.URI;

/** Public platform URLs shared by backend modules. */
@ConfigMapping(prefix = "surplasse.platform")
public interface PlatformConfig {

    URI problemTypeBase();
}
