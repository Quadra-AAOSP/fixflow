package com.example.fixflow.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class UrgencyBackfill implements ApplicationRunner {
    private final ReportService reports;
    public UrgencyBackfill(ReportService reports) { this.reports = reports; }
    @Override public void run(ApplicationArguments args) { long cursor = 0;
        while (cursor >= 0) cursor = reports.backfillCalculatedUrgency(cursor); }
}
