import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteSiteRule,
  listAllSiteRules,
  saveSiteRule,
} from "@/services/siteRules";
import type { SiteRule, SiteType } from "@/types";

const types: SiteType[] = ["school", "hostel", "hotel"];
export default function SiteRulesScreen() {
  const { user } = useAuth();
  const { i18n } = useTranslation("common");
  const tr = (en: string, zh: string) =>
    i18n.language.startsWith("zh") ? zh : en;
  const allowed = user?.role === "admin" || user?.role === "super_admin";
  const [rules, setRules] = useState<SiteRule[]>([]);
  const [filter, setFilter] = useState<SiteType | "all">("all");
  const [editing, setEditing] = useState(false);
  const [id, setId] = useState<number | null>(null);
  const [siteType, setSiteType] = useState<SiteType>("school");
  const [category, setCategory] = useState("");
  const [weight, setWeight] = useState("0");
  const [order, setOrder] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!allowed) return;
    setBusy(true);
    setError("");
    try {
      setRules(await listAllSiteRules());
    } catch {
      setError("load");
    } finally {
      setBusy(false);
    }
  }, [allowed]);
  useEffect(() => {
    void load();
  }, [load]);
  function edit(rule?: SiteRule) {
    setId(rule?.id ?? null);
    setSiteType(rule?.siteType ?? (filter === "all" ? "school" : filter));
    setCategory(rule?.category ?? "");
    setWeight(String(rule?.urgencyWeight ?? 0));
    setOrder(String(rule?.sortOrder ?? 0));
    setError("");
    setEditing(true);
  }
  async function save() {
    if (busy || !allowed) return;
    if (
      !category.trim() ||
      !/^-?\d+$/.test(weight) ||
      !/^-?\d+$/.test(order) ||
      ![Number(weight), Number(order)].every(
        (n) => Number.isInteger(n) && n >= -2147483648 && n <= 2147483647,
      )
    ) {
      setError("validation");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await saveSiteRule(id, {
        siteType,
        category,
        urgencyWeight: Number(weight),
        sortOrder: Number(order),
      });
      setRules((old) => [...old.filter((r) => r.id !== saved.id), saved]);
      setEditing(false);
    } catch {
      setError("save");
    } finally {
      setBusy(false);
    }
  }
  async function remove(rule: SiteRule) {
    if (busy || !allowed) return;
    setBusy(true);
    setError("");
    try {
      await deleteSiteRule(rule.id);
      setRules((old) => old.filter((r) => r.id !== rule.id));
    } catch {
      setError("delete");
    } finally {
      setBusy(false);
    }
  }
  if (!allowed)
    return (
      <Screen>
        <Text>{tr("Access denied", "无权访问")}</Text>
      </Screen>
    );
  const visible = rules.filter(
    (r) => filter === "all" || r.siteType === filter,
  );
  return (
    <Screen>
      <ScrollView
        contentContainerClassName="p-5 gap-3"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-ink">
          {tr(
            "Rules apply to every site of the selected type. Changes affect report intake and AI taxonomy.",
            "规则适用于所选类型的所有站点。更改会影响报修和 AI 分类。",
          )}
        </Text>
        {error ? (
          <Text accessibilityRole="alert" className="text-red-600">
            {error === "validation"
              ? tr(
                  "Enter a category and valid whole-number values.",
                  "请输入分类和有效整数。",
                )
              : tr(
                  "Unable to complete the action. Please retry.",
                  "无法完成操作，请重试。",
                )}
          </Text>
        ) : null}
        {error === "load" && (
          <Button label={tr("Retry", "重试")} onPress={load} disabled={busy} />
        )}
        <Button
          label={tr("Add category", "添加分类")}
          onPress={() => edit()}
          disabled={busy}
        />
        {editing && (
          <View className="gap-3">
            <Text className="font-bold text-ink">
              {id === null
                ? tr("Add category", "添加分类")
                : tr("Edit rule", "编辑规则")}
            </Text>
            <Text>{tr("Site type", "站点类型")}</Text>
            <View className="flex-row flex-wrap gap-2">
              {types.map((type) => (
                <Button
                  key={type}
                  label={type}
                  variant={siteType === type ? "cta" : "secondary"}
                  onPress={() => setSiteType(type)}
                  disabled={busy}
                />
              ))}
            </View>
            <TextField
              label={tr("Category code", "分类代码")}
              value={category}
              onChangeText={setCategory}
              maxLength={128}
              editable={!busy}
            />
            <TextField
              label={tr("Urgency weight", "紧急权重")}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numbers-and-punctuation"
              editable={!busy}
            />
            <TextField
              label={tr("Sort order", "排序")}
              value={order}
              onChangeText={setOrder}
              keyboardType="numbers-and-punctuation"
              editable={!busy}
            />
            <Button
              label={tr("Save rule", "保存规则")}
              onPress={save}
              loading={busy}
            />
            <Button
              label={tr("Cancel", "取消")}
              variant="secondary"
              onPress={() => setEditing(false)}
              disabled={busy}
            />
          </View>
        )}
        <Text>{tr("Filter by site type", "按站点类型筛选")}</Text>
        <View className="flex-row flex-wrap gap-2">
          {(["all", ...types] as const).map((type) => (
            <Button
              key={type}
              label={type === "all" ? tr("All", "全部") : type}
              variant={filter === type ? "cta" : "secondary"}
              onPress={() => setFilter(type)}
            />
          ))}
        </View>
        {visible.map((rule) => (
          <View
            key={rule.id}
            className="gap-2 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4"
          >
            <Text className="font-bold text-ink">{rule.category}</Text>
            <Text>
              {rule.siteType} · {tr("Urgency weight", "紧急权重")}:{" "}
              {rule.urgencyWeight} · {tr("Sort order", "排序")}:{" "}
              {rule.sortOrder}
            </Text>
            <View className="flex-row gap-2">
              <Button
                label={tr("Edit", "编辑")}
                variant="secondary"
                onPress={() => edit(rule)}
                disabled={busy}
              />
              <Button
                label={tr("Delete", "删除")}
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    tr("Delete rule?", "删除规则？"),
                    tr(
                      `Permanently delete ${rule.category} for all ${rule.siteType} sites?`,
                      `永久删除所有 ${rule.siteType} 站点的 ${rule.category} 分类？`,
                    ),
                    [
                      { text: tr("Cancel", "取消"), style: "cancel" },
                      {
                        text: tr("Delete permanently", "永久删除"),
                        style: "destructive",
                        onPress: () => void remove(rule),
                      },
                    ],
                  )
                }
              />
            </View>
          </View>
        ))}
        {!busy && !error && visible.length === 0 && (
          <Text>
            {tr("No rules for this site type.", "此站点类型没有规则。")}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
