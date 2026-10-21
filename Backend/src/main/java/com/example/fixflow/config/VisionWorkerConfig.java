package com.example.fixflow.config;

import com.example.fixflow.service.ReportVisionService;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Configuration @EnableScheduling
@ConditionalOnProperty(prefix = "openrouter.vision", name = "enabled", havingValue = "true")
public class VisionWorkerConfig {
    private final ReportVisionService service;
    public VisionWorkerConfig(ReportVisionService service) { this.service = service; }
    @org.springframework.context.annotation.Bean
    public org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler visionScheduler() {
        var scheduler = new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("vision-");
        return scheduler;
    }
    @Scheduled(scheduler = "visionScheduler", fixedDelayString = "${openrouter.vision.poll-ms:2000}")
    public void process() { service.processPending(); }
}
