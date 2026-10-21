package com.example.fixflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.example.fixflow.config.BootstrapProperties;
import com.example.fixflow.config.BootstrapSuperAdminRunner;
import com.example.fixflow.config.ShopCatalogSeeder;
import com.example.fixflow.config.SiteRulesSeeder;
import com.example.fixflow.config.SqlDataSeeder;
import com.example.fixflow.repository.ShopProductRepository;
import com.example.fixflow.repository.SiteRuleRepository;
import com.example.fixflow.repository.UserRepository;

class SeederModeTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(SiteRulesSeeder.class, ShopCatalogSeeder.class,
                    BootstrapSuperAdminRunner.class, SqlDataSeeder.class)
            .withBean(SiteRuleRepository.class, () -> mock(SiteRuleRepository.class))
            .withBean(ShopProductRepository.class, () -> mock(ShopProductRepository.class))
            .withBean(UserRepository.class, () -> mock(UserRepository.class))
            .withBean(PasswordEncoder.class, () -> mock(PasswordEncoder.class))
            .withBean(BootstrapProperties.class, () -> new BootstrapProperties("", ""))
            .withBean(DataSource.class, () -> mock(DataSource.class));

    @Test
    void defaultKeepsOriginalSeeders() {
        assertNormalMode(context);
        assertNormalMode(context.withPropertyValues("fixflow.seed.demo-enabled=false"));
    }

    private void assertNormalMode(ApplicationContextRunner runner) {
        runner.run(app -> {
            assertThat(app).hasSingleBean(SiteRulesSeeder.class).hasSingleBean(ShopCatalogSeeder.class)
                    .hasSingleBean(BootstrapSuperAdminRunner.class).doesNotHaveBean(SqlDataSeeder.class);
        });
    }

    @Test
    void demoModeDisablesOriginalSeedersAndEnablesSqlOnly() {
        context.withPropertyValues("fixflow.seed.demo-enabled=true").run(app -> {
            assertThat(app).hasSingleBean(SqlDataSeeder.class).doesNotHaveBean(SiteRulesSeeder.class)
                    .doesNotHaveBean(ShopCatalogSeeder.class).doesNotHaveBean(BootstrapSuperAdminRunner.class);
        });
    }
}
